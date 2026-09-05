#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import {
  admitPaidStudyLaunch,
  isResponseFreeJsonModeRejection,
  isResponseFreeParameterRejection,
} from '../services/paidStudyLaunchContract.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import { resolveEvaluationDataHome } from '../services/evaluationDataPaths.js';
import {
  createLongRunningWorkflowStatus,
  updateLongRunningWorkflowProgress,
  completeLongRunningWorkflowPhase,
  blockLongRunningWorkflow,
  writeLongRunningWorkflowStatusAtomic,
} from '../services/longRunningWorkflowStatus.js';
import {
  DESIGN_PATH,
  readEvents,
  readJson,
  writeOnce,
  sha256,
  loadReplayDesign,
  prepareReplayPlan,
  buildReplayRequest,
  classifyReplayResponse,
  retainsInvalidCalibrationResponses,
  recoversCalibrationParameterRejections,
  replaySamplingParameters,
  worstCost,
  summarizeReplay,
} from '../services/superegoCritiqueCausalReplay.js';
import {
  prepareCalibrationPlan,
  calibrationCoderPackets,
  summarizeCalibration,
} from '../services/superegoCritiqueMeasurementCalibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHASES = ['PREFLIGHT', 'GENERATING', 'AUDITING', 'EXTRACTING', 'PACKAGING', 'WORKFLOW_COMPLETE'];
const inactive = { state: 'inactive', explanation: 'No provider request is in flight.' };
const stableSettings = (design) => ({
  ...(design.mode === 'calibration'
    ? { mode: design.mode, historical_model_routes: design.historical_model_routes }
    : {}),
  seed: design.master_seed,
  models: design.models,
  request: design.request,
  attempts: design.attempts,
  max_dollars: design.max_dollars,
  primary: design.primary,
  arms: design.arms,
  endpoint: design.endpoint,
  ...(design.response_failure_policy ? { response_failure_policy: design.response_failure_policy } : {}),
  ...(design.routing_failure_policy ? { routing_failure_policy: design.routing_failure_policy } : {}),
});

// Public catalog reads only: no key, prompt, provider inference or run admission.
// Keep unsupported registered controls explicit rather than silently dropping them.
export async function checkReplayRouteParameters(design, plan, fetchMetadata = globalThis.fetch) {
  const routes = new Map();
  for (const job of plan.jobs) {
    const route = design.models[job.seat];
    const required = [...Object.keys(replaySamplingParameters(design, job.seat)), 'max_tokens', 'reasoning'];
    if (job.category !== 'generation') required.push('response_format');
    const key = `${route.model}/${route.provider_slug}`;
    const item = routes.get(key) || { route, required: new Set() };
    required.forEach((parameter) => item.required.add(parameter));
    routes.set(key, item);
  }
  const results = await Promise.all(
    [...routes.values()].map(async ({ route, required }) => {
      const url = `${new URL(design.endpoint).origin}/api/v1/models/${route.model}/endpoints`;
      const response = await fetchMetadata(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Route metadata unavailable for ${route.model}: HTTP ${response.status}`);
      const { data } = await response.json();
      if (data?.id !== route.model || !Array.isArray(data.endpoints))
        throw new Error(`Invalid route metadata for ${route.model}`);
      const endpoints = data.endpoints.filter(
        (endpoint) =>
          endpoint.provider_name === route.provider &&
          (endpoint.tag === route.provider_slug || endpoint.tag?.startsWith(`${route.provider_slug}/`)),
      );
      const supports = (endpoint) =>
        [...required].every((parameter) => endpoint.supported_parameters?.includes(parameter));
      if (!endpoints.some(supports)) {
        const missing = [...required].filter(
          (parameter) => !endpoints.some((endpoint) => endpoint.supported_parameters?.includes(parameter)),
        );
        throw new Error(
          `Registered route ${route.model} via ${route.provider} cannot support all request controls: ${missing.join(', ') || 'no single eligible endpoint'}. No paid admission or call was made.`,
        );
      }
      return { model: route.model, provider: route.provider, parameters: [...required] };
    }),
  );
  return results;
}

// Exactly one HTTP request. No SDK retry, status retry, fallback, or model repair.
export async function dispatchReplayRequest(endpoint, request, timeoutMs, fetchImpl = globalThis.fetch) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is absent');
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    const failure = new Error(`Transport failed without a durable response: ${error.name}`);
    failure.recoverable = true;
    throw failure;
  }
}

export function loadRecoveryResponses(design, plan, predecessor) {
  const segments = [];
  const seen = new Set();
  let current = predecessor;
  while (current) {
    const dir = path.resolve(current);
    if (seen.has(dir)) throw new Error('Recovery chain cycle');
    seen.add(dir);
    const events = readEvents(path.join(dir, 'run-ledger.jsonl'));
    const launch = events.find((e) => e.type === 'launch_admitted');
    if (!launch || events.at(-1)?.type !== 'run_sealed') throw new Error('Recovery predecessor is not sealed');
    if (JSON.stringify(readJson(path.join(dir, 'plan.json'))) !== JSON.stringify(plan))
      throw new Error('Frozen recovery plan drift');
    const previousSettings = readJson(path.join(dir, 'settings.json'));
    // Compare protected settings, allowing only the two registered calibration
    // amendments. These are in-memory comparisons; sealed settings stay intact.
    if (retainsInvalidCalibrationResponses(design) && !previousSettings.response_failure_policy)
      previousSettings.response_failure_policy = design.response_failure_policy;
    if (recoversCalibrationParameterRejections(design)) {
      if (!previousSettings.routing_failure_policy)
        previousSettings.routing_failure_policy = design.routing_failure_policy;
      if (
        !previousSettings.request.provider_native_sampling_seats &&
        previousSettings.request.temperature === 0 &&
        previousSettings.request.top_p === 1
      )
        previousSettings.request.provider_native_sampling_seats = design.request.provider_native_sampling_seats;
    }
    if (!isDeepStrictEqual(previousSettings, stableSettings(design)))
      throw new Error('Study settings changed during recovery');
    segments.unshift({ dir, events });
    current = launch.recovery_from;
  }
  const responses = new Map();
  const savedRequests = new Map();
  const parameterRejectionUnits = new Set();
  for (const { dir, events } of segments) {
    for (const reservation of events.filter((e) => e.type === 'model_attempt_dispatch_reserved')) {
      const job = plan.jobs.find((j) => j.id === reservation.unit_id);
      if (!job) throw new Error('Unknown job in predecessor attempts');
      const requestFile = path.join(dir, 'requests', `${reservation.study_reserved}.json`);
      if (fs.existsSync(requestFile)) savedRequests.set(job.id, readJson(requestFile));
      const persisted = events.find(
        (e) => e.type === 'attempt_response_persisted' && e.attempt_id === reservation.attempt_id,
      );
      const responseFile = path.join(dir, 'responses', `${reservation.study_reserved}.json`);
      if (
        persisted &&
        (!fs.existsSync(responseFile) ||
          path.resolve(persisted.response_path) !== responseFile ||
          sha256(fs.readFileSync(responseFile)) !== persisted.response_sha256)
      )
        throw new Error('Sealed response data mismatch');
      // Also recover the fsynced response in the narrow write-before-journal crash window.
      if (!fs.existsSync(responseFile)) continue;
      const bundle = readJson(responseFile);
      if (
        bundle.attempt_id !== reservation.attempt_id ||
        bundle.job.id !== job.id ||
        JSON.stringify(bundle.request) !== JSON.stringify(savedRequests.get(job.id))
      )
        throw new Error('Response has no matching durable request/reservation');
      if (job.category === 'generation' && isResponseFreeJsonModeRejection(bundle.request, bundle.raw)) {
        // Remove only the unsupported transport option from this rejected
        // request. The normal comparison below still rejects any payload,
        // route, sampling, token-limit or other change. Never edit the original.
        const { response_format: _unsupported, ...repaired } = bundle.request;
        savedRequests.set(job.id, repaired);
        continue;
      }
      if (
        recoversCalibrationParameterRejections(design) &&
        isResponseFreeParameterRejection(bundle.request, bundle.raw)
      ) {
        const expected = buildReplayRequest(design, plan, job, responses);
        let repaired = bundle.request;
        if (
          design.request.provider_native_sampling_seats?.includes(job.seat) &&
          repaired.temperature === 0 &&
          repaired.top_p === 1
        ) {
          const { temperature: _temperature, top_p: _topP, ...native } = repaired;
          repaired = native;
        }
        if (!isDeepStrictEqual(repaired, expected)) throw new Error('Rejected request differs from registered scope');
        savedRequests.set(job.id, expected);
        parameterRejectionUnits.add(job.id);
        continue;
      }
      try {
        if (JSON.stringify(bundle.request) !== JSON.stringify(buildReplayRequest(design, plan, job, responses)))
          throw new Error('Retained response request differs from registered builder');
        const parsed = classifyReplayResponse(design, bundle.request, job, bundle.raw);
        if (responses.has(job.id)) throw new Error('Conflicting duplicate successful response');
        responses.set(job.id, parsed);
      } catch (error) {
        if (!error.recoverable) throw error;
      }
    }
  }
  return {
    responses,
    savedRequests,
    segments,
    parameterRejectionUnits: [...parameterRejectionUnits].filter((id) => !responses.has(id)),
  };
}

export function checkReplayBudget(design, job, events, request = null) {
  const reservations = events.filter((e) => e.type === 'study_model_attempt_dispatch_reserved');
  if (reservations.length >= design.attempts.hard_ceiling)
    throw new Error('Hard attempt ceiling exhausted before call');
  const categoryCap = design.attempts[`${job.category}_planned`] + design.attempts[`${job.category}_reserve`];
  if (reservations.filter((e) => e.category === job.category).length >= categoryCap)
    throw new Error('Category attempt ceiling exhausted before call');
  if (reservations.filter((e) => e.unit_id === job.id).length >= 2)
    throw new Error('Repeated technical failure: one replacement maximum');
  if (
    reservations.some(
      (e) =>
        !Number.isFinite(e.max_cost_dollars) ||
        e.max_cost_dollars < 0 ||
        !['generation', 'semantic', 'quality'].includes(e.category),
    )
  )
    throw new Error('Unaccountable predecessor reservation');
  const priorDollars = reservations.reduce((sum, e) => sum + e.max_cost_dollars, 0);
  const cost = worstCost(design, job.seat, request);
  if (priorDollars + cost > design.max_dollars) throw new Error('Dollar ceiling exhausted before call');
  return { cost, priorDollars, priorAttempts: reservations.length };
}

export async function executeReplay({
  root = ROOT,
  plan,
  design,
  destination,
  goNotePath,
  goNoteCommit,
  recoveryFrom = null,
  studyStateRoot = path.join(resolveEvaluationDataHome(), 'paid-studies'),
  dispatch = dispatchReplayRequest,
  signalTarget = process,
  onProgress = () => {},
  faultAt = null,
}) {
  if (
    plan.study_id !== design.id ||
    plan.units.length !== design.sample_size ||
    plan.jobs.length !== design.attempts.total_planned
  ) {
    throw new Error('Prepared plan differs from registered study size');
  }
  const recovered = recoveryFrom
    ? loadRecoveryResponses(design, plan, recoveryFrom)
    : { responses: new Map(), savedRequests: new Map(), segments: [] };
  const admission = admitPaidStudyLaunch({
    root,
    designPath: DESIGN_PATH,
    goNotePath,
    goNoteCommit,
    spendCap: design.attempts.hard_ceiling,
    studyId: design.id,
    studyStateRoot,
    destination: path.resolve(destination),
    recoveryFrom: recoveryFrom ? path.resolve(recoveryFrom) : undefined,
    retainedResponseUnits:
      recoveryFrom && retainsInvalidCalibrationResponses(design) ? [...recovered.responses.keys()] : [],
    parameterRejectionUnits: recovered.parameterRejectionUnits || [],
  });
  const budget = createDurablePaidModelAttemptBudget({ admission, limit: design.attempts.hard_ceiling });
  const responses = recovered.responses;
  const nextAction = (description) => ({
    description,
    stopping_condition: 'Stop on failure, pause, or completion of the fixed job list.',
  });
  const phases = design.attempts.generation_planned ? PHASES : PHASES.filter((phase) => phase !== 'GENERATING');
  let status = createLongRunningWorkflowStatus({ workflowId: design.id, phasePlan: phases, modelActivity: inactive });
  const statusPath = path.join(admission.destination, 'workflow-status.json');
  let pauseRequested = false;
  let activeJob = null;
  let failure = null;
  let rawPersisted = false;
  const durations = [];
  const pause = () => {
    pauseRequested = true;
    admission.record({ type: 'pause_requested', job_id: activeJob?.id || null });
  };
  const update = (activity = inactive) => {
    const events = [...recovered.segments.flatMap((s) => s.events), ...readEvents(admission.ledger_path)];
    const completed = events.filter((e) => e.type === 'attempt_completed').length;
    const failed = events.filter((e) =>
      ['attempt_failed', 'attempt_interrupted_after_dispatch', 'attempt_cancelled_before_dispatch'].includes(e.type),
    ).length;
    const invalid = [...responses.values()].filter((r) => r.response_status === 'invalid_response').length;
    status = updateLongRunningWorkflowProgress(status, {
      units: {
        complete: responses.size - invalid,
        active: activeJob && !failure ? 1 : 0,
        failed: invalid + (failure ? 1 : 0),
        missing: Math.max(0, plan.jobs.length - responses.size - (activeJob ? 1 : 0)),
      },
      calls: { completed, failed, reserved: admission.studyReserved, hard_ceiling: design.attempts.hard_ceiling },
      recentUnitDurationsMs: durations.slice(-8),
      modelActivity: activity,
      ...(!failure
        ? {
            nextAction: nextAction(
              activeJob ? `${activeJob.category}: ${activeJob.id}` : 'Advance the fixed replay job list.',
            ),
          }
        : {}),
    });
    writeLongRunningWorkflowStatusAtomic(statusPath, status);
    onProgress(status);
  };
  const transition = (nextPhase) => {
    status = completeLongRunningWorkflowPhase(status, {
      phase: status.current_phase,
      nextPhase,
      startNextImmediately: true,
      modelActivity: inactive,
      nextAction: nextAction(`Start ${nextPhase}.`),
    });
    update();
  };
  signalTarget.on('SIGINT', pause);
  signalTarget.on('SIGTERM', pause);
  // Timed status updates explicitly avoid claiming that a pending HTTP request proves live inference.
  const heartbeat = setInterval(() => {
    try {
      status = updateLongRunningWorkflowProgress(status, {
        modelActivity: activeJob
          ? { state: 'unverifiable', explanation: 'HTTP request pending; no provider-side live activity evidence.' }
          : inactive,
      });
      writeLongRunningWorkflowStatusAtomic(statusPath, status);
      onProgress(status);
    } catch {
      pauseRequested = true;
    }
  }, 60000);
  heartbeat.unref();
  try {
    writeOnce(path.join(admission.destination, 'plan.json'), plan);
    writeOnce(path.join(admission.destination, 'settings.json'), stableSettings(design));
    admission.record({
      type: recoveryFrom ? 'resuming' : 'plan_ready',
      seed: plan.seed,
      recovered_jobs: responses.size,
      retained_invalid_jobs: [...responses.values()].filter((r) => r.response_status === 'invalid_response').length,
    });
    transition(design.attempts.generation_planned ? 'GENERATING' : 'AUDITING');
    for (const job of plan.jobs) {
      if (responses.has(job.id)) continue;
      if (pauseRequested) break;
      if (job.category !== 'generation' && status.current_phase === 'GENERATING') transition('AUDITING');
      activeJob = job;
      rawPersisted = false;
      const started = Date.now();
      const expectedRequest = buildReplayRequest(design, plan, job, responses);
      const request = recovered.savedRequests.get(job.id) || expectedRequest;
      // Compare saved scientific payload and decoding policy, not source-file digests.
      // A parser/ledger code repair does not change or reapprove the study.
      if (JSON.stringify(request) !== JSON.stringify(expectedRequest))
        throw new Error('Saved request exceeds registered scope');
      const route = design.models[job.seat];
      const limits = checkReplayBudget(design, job, readEvents(admission.study_ledger_path), request);
      const reservation = budget.reserve({
        unitId: job.id,
        role: job.seat,
        category: job.category,
        max_cost_dollars: limits.cost,
        configured_model: route.model,
        configured_provider: route.provider,
      });
      writeOnce(path.join(admission.destination, 'requests', `${reservation.study_reserved}.json`), request);
      update();
      if (faultAt === 'after_reservation') throw new Error('Injected fault after reservation');
      budget.markDispatched();
      update({
        state: 'unverifiable',
        explanation: 'A single HTTP dispatch is pending; server inference is not independently observable.',
      });
      const raw = await dispatch(design.endpoint, request, design.request.timeout_ms);
      const responsePath = path.join(admission.destination, 'responses', `${reservation.study_reserved}.json`);
      writeOnce(responsePath, { attempt_id: reservation.attemptId, job, request, raw });
      if (faultAt === 'after_response_write') throw new Error('Injected fault after durable response write');
      budget.persistResponse(responsePath);
      rawPersisted = true;
      budget.complete();
      if (faultAt === 'after_response_persisted') throw new Error('Injected fault after durable response persistence');
      const parsed = classifyReplayResponse(design, request, job, raw);
      responses.set(job.id, parsed);
      admission.record({
        type: parsed.response_status === 'invalid_response' ? 'job_invalid_response' : 'job_complete',
        job_id: job.id,
        category: job.category,
        ...(parsed.invalid_reason ? { invalid_reason: parsed.invalid_reason } : {}),
        observed_usage: JSON.parse(raw.body).usage,
        cost_status: JSON.parse(raw.body).usage.cost === undefined ? 'unknown' : 'reported',
      });
      durations.push(Date.now() - started);
      activeJob = null;
      update();
    }
    if (pauseRequested) {
      admission.record({ type: 'paused', missing_jobs: plan.jobs.length - responses.size });
      status = blockLongRunningWorkflow(status, {
        blockedPhase: status.current_phase,
        error: 'Operator pause at safe boundary',
        operation: 'replay jobs',
        modelActivity: inactive,
        nextAction: nextAction('Resume only missing jobs in a fresh segment.'),
      });
      writeLongRunningWorkflowStatusAtomic(statusPath, status);
      return { status: 'paused_recoverable', completed: responses.size };
    }
    if (status.current_phase === 'GENERATING') transition('AUDITING');
    transition('EXTRACTING');
    const report = (design.mode === 'calibration' ? summarizeCalibration : summarizeReplay)(design, plan, responses);
    writeOnce(path.join(admission.destination, 'report.json'), report);
    transition('PACKAGING');
    writeOnce(path.join(admission.destination, 'archive-inventory.json'), {
      study_id: design.id,
      predecessor: recoveryFrom,
      directories: ['requests', 'responses'],
      files: ['plan.json', 'settings.json', 'run-ledger.jsonl', 'workflow-status.json', 'report.json'],
      status: 'local_package_ready_private_archive_pending',
    });
    status = completeLongRunningWorkflowPhase(status, {
      phase: 'PACKAGING',
      nextPhase: 'WORKFLOW_COMPLETE',
      handoffExplanation: 'Local package is complete; private archive verification remains an operator task.',
      nextAction: {
        description: 'Archive this segment and all predecessors using the maintained private artifact workflow.',
        stopping_condition: 'Verify the archive before workflow completion.',
      },
      modelActivity: inactive,
    });
    writeLongRunningWorkflowStatusAtomic(statusPath, status);
    onProgress(status);
    return { status: 'local_package_ready', report, destination: admission.destination };
  } catch (error) {
    if (['EIO', 'ENOSPC', 'EMFILE', 'ENFILE', 'EACCES', 'EROFS'].includes(error.code)) error.recoverable = true;
    failure = error;
    if (!rawPersisted) budget.fail(error);
    status = blockLongRunningWorkflow(status, {
      blockedPhase: status.current_phase,
      error: error.message,
      operation: activeJob?.id || 'replay setup/extraction',
      modelActivity: inactive,
      nextAction: nextAction(
        error.recoverable || faultAt
          ? 'Recover missing work in a fresh segment after verifying the failure.'
          : 'Inspect retained evidence; no automatic resampling.',
      ),
    });
    update();
    throw error;
  } finally {
    clearInterval(heartbeat);
    signalTarget.removeListener('SIGINT', pause);
    signalTarget.removeListener('SIGTERM', pause);
    const attempts = readEvents(admission.study_ledger_path).filter(
      (e) => e.type === 'study_model_attempt_dispatch_reserved' && e.unit_id === activeJob?.id,
    ).length;
    const recoverable = pauseRequested || Boolean(failure && (failure.recoverable || faultAt) && attempts < 2);
    admission.close({
      type: 'run_sealed',
      status: failure ? 'technical_failure' : pauseRequested ? 'paused_recoverable' : 'local_package_ready',
      recovery_permitted: recoverable,
      reason: failure?.message || null,
      completed_jobs: [...responses.values()].filter((r) => r.response_status !== 'invalid_response').length,
      invalid_jobs: [...responses.values()].filter((r) => r.response_status === 'invalid_response').length,
      missing_jobs: plan.jobs.length - responses.size,
    });
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      mode: { type: 'string', default: 'replay' },
      prepare: { type: 'boolean' },
      launch: { type: 'boolean' },
      'accept-charges': { type: 'boolean' },
      output: { type: 'string' },
      logs: { type: 'string' },
      'recovery-from': { type: 'string' },
      'go-note': { type: 'string' },
      'go-note-commit': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: run-superego-critique-causal-replay.js [--mode replay|calibration] --prepare --output <new-directory> [--logs <path>]\nPaid: --launch --accept-charges --output <new-directory> --go-note <notes/path.md> --go-note-commit <commit> [--recovery-from <sealed-directory>]\nGO is not a launch instruction. Use paid mode only after separately authorized launch.',
    );
    return;
  }
  if (!['replay', 'calibration'].includes(values.mode)) throw new Error('Unknown study mode');
  if (!values.output || Boolean(values.prepare) === Boolean(values.launch))
    throw new Error('Choose exactly --prepare or --launch and a new --output');
  if (values.launch && (!values['accept-charges'] || !values['go-note'] || !values['go-note-commit']))
    throw new Error('Paid mode requires launch authority, --accept-charges and the committed GO note');
  const root = overrides.root || ROOT;
  const prepare = values.mode === 'calibration' ? prepareCalibrationPlan : prepareReplayPlan;
  const { design, plan } = await (overrides.preparePlan || prepare)(root, { logs: values.logs });
  if (values.prepare) {
    fs.mkdirSync(path.resolve(values.output), { recursive: false });
    writeOnce(path.join(path.resolve(values.output), 'plan.json'), plan);
    writeOnce(path.join(path.resolve(values.output), 'audit.json'), {
      ...plan.audit,
      calls_completed: 0,
      calls_reserved: 0,
      hard_ceiling: 0,
    });
    if (values.mode === 'calibration') {
      for (const [seat, packet] of Object.entries(calibrationCoderPackets(design, plan)))
        writeOnce(path.join(path.resolve(values.output), `human-${seat}.json`), packet);
    }
    console.log(JSON.stringify({ units: plan.units.length, jobs: plan.jobs.length, calls: 0 }));
    return { design, plan };
  }
  await checkReplayRouteParameters(design, plan, overrides.metadataFetch);
  return executeReplay({
    root,
    design: loadReplayDesign(root, { mode: values.mode }),
    plan,
    destination: values.output,
    goNotePath: values['go-note'],
    goNoteCommit: values['go-note-commit'],
    recoveryFrom: values['recovery-from'],
    onProgress: (status) =>
      console.log(
        JSON.stringify({
          phase: status.current_phase,
          units: status.units,
          calls: status.calls,
          model_activity: status.model_activity,
        }),
      ),
    ...overrides,
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
