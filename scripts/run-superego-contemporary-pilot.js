#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { admitPaidStudyLaunch, verifyPaidStudyLaunchContract } from '../services/paidStudyLaunchContract.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import { resolveEvaluationDataHome } from '../services/evaluationDataPaths.js';
import { readEvents, readJson, writeOnce, sha256 } from '../services/superegoCritiqueCausalReplay.js';
import {
  createLongRunningWorkflowStatus,
  updateLongRunningWorkflowProgress,
  completeLongRunningWorkflowPhase,
  blockLongRunningWorkflow,
  writeLongRunningWorkflowStatusAtomic,
} from '../services/longRunningWorkflowStatus.js';
import {
  DESIGN_PATH,
  SCHEMAS,
  loadPilotDesign,
  preparePilot,
  buildPilotRequest,
  pilotPayload,
  checkPilotBudget,
  reservationCost,
  parsePilotResponse,
  humanPacket,
  validateHumanRatings,
  loadHumanReferences,
  summarizePilot,
} from '../services/superegoContemporaryPilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inactive = { state: 'inactive', explanation: 'No provider request is in flight.' };
const next = (description) => ({
  description,
  stopping_condition: 'Stop at a failure or the registered human/archive handoff.',
});
const safeCode = (value) => (typeof value === 'string' && /^[A-Za-z0-9_]{1,80}$/u.test(value) ? value : 'unknown');

export async function dispatchPilot(request, timeoutMs, fetchImpl = globalThis.fetch) {
  const anthropic = request.provider === 'anthropic';
  const key = process.env[anthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'];
  if (!key) throw new Error(`Missing ${anthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'}`);
  let stage = 'dispatch';
  let requestId = null;
  try {
    const response = await fetchImpl(request.endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: anthropic
        ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    stage = 'body_read';
    const id = response.headers.get('request-id') || response.headers.get('x-request-id');
    requestId = typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/u.test(id) ? id : null;
    return { status: response.status, request_id: requestId, body: await response.text() };
  } catch (cause) {
    const diagnostic = {
      stage,
      name: safeCode(cause.name),
      cause_code: safeCode(cause.cause?.code || cause.code),
      request_id: requestId,
    };
    const error = new Error(`Transport ${diagnostic.stage}: ${diagnostic.name}/${diagnostic.cause_code}`);
    error.diagnostic = diagnostic;
    error.recoverable = true;
    throw error;
  }
}

export function recoverPilot(design, plan, predecessor) {
  const segments = [],
    seen = new Set();
  let dir = predecessor ? path.resolve(predecessor) : null;
  while (dir) {
    if (seen.has(dir)) throw new Error('Recovery cycle');
    seen.add(dir);
    if (
      !isDeepStrictEqual(readJson(path.join(dir, 'plan.json')), plan) ||
      !isDeepStrictEqual(readJson(path.join(dir, 'settings.json')), design)
    )
      throw new Error('Recovery changes the registered plan or settings');
    const events = readEvents(path.join(dir, 'run-ledger.jsonl'));
    const launch = events.find((e) => e.type === 'launch_admitted');
    if (!launch || events.at(-1)?.type !== 'run_sealed')
      throw new Error('Reconcile interrupted segment with the shared interruption helper first');
    segments.unshift({ dir, events });
    dir = launch.recovery_from || null;
  }
  const results = new Map(),
    requests = new Map();
  for (const segment of segments)
    for (const reservation of segment.events.filter((e) => e.type === 'model_attempt_dispatch_reserved')) {
      const job = plan.jobs.find((j) => j.id === reservation.unit_id);
      if (!job) throw new Error('Unknown predecessor job');
      const requestPath = path.join(segment.dir, 'requests', `${reservation.study_reserved}.json`);
      if (!fs.existsSync(requestPath)) {
        if (
          segment.events.some(
            (e) =>
              e.attempt_id === reservation.attempt_id &&
              ['attempt_dispatched', 'attempt_response_persisted'].includes(e.type),
          ) ||
          fs.existsSync(path.join(segment.dir, 'responses', `${reservation.study_reserved}.json`))
        )
          throw new Error('Dispatched attempt is missing its request');
        continue; // a cancelled reservation may precede request persistence
      }
      const request = readJson(requestPath);
      if (!isDeepStrictEqual(request, buildPilotRequest(design, plan, job, results)))
        throw new Error('Recovery changes a scientific request');
      requests.set(job.id, request);
      const responsePath = path.join(segment.dir, 'responses', `${reservation.study_reserved}.json`);
      const persisted = segment.events.find(
        (e) => e.type === 'attempt_response_persisted' && e.attempt_id === reservation.attempt_id,
      );
      if (
        persisted &&
        (!fs.existsSync(responsePath) ||
          path.resolve(persisted.response_path) !== responsePath ||
          sha256(fs.readFileSync(responsePath)) !== persisted.response_sha256)
      )
        throw new Error('Sealed response data mismatch');
      if (!fs.existsSync(responsePath)) continue;
      const bundle = readJson(responsePath);
      if (
        bundle.attempt_id !== reservation.attempt_id ||
        bundle.job.id !== job.id ||
        !isDeepStrictEqual(bundle.request, request)
      )
        throw new Error('Unmatched durable response');
      try {
        const result = parsePilotResponse(design, request, job, bundle.raw, pilotPayload(plan, job, results));
        if (results.has(job.id)) throw new Error('Duplicate retained answer');
        results.set(job.id, result);
      } catch (error) {
        if (!error.recoverable) throw error;
      }
    }
  return { results, requests, segments };
}

export async function executePilot({
  root = ROOT,
  design = loadPilotDesign(root),
  plan = preparePilot(root, design),
  phase = 'generation',
  destination,
  goNotePath,
  goNoteCommit = 'HEAD',
  recoveryFrom = null,
  qualityPath = null,
  semanticPath = null,
  studyStateRoot = path.join(resolveEvaluationDataHome(), 'paid-studies'),
  dispatch = dispatchPilot,
  onProgress = () => {},
  signalTarget = process,
}) {
  if (!['generation', 'judging'].includes(phase)) throw new Error('Unknown phase');
  if (!isDeepStrictEqual(plan, preparePilot(root, design))) throw new Error('Plan differs from registered preparation');
  const recovered = recoverPilot(design, plan, recoveryFrom);
  if (recovered.segments.length && recovered.segments.at(-1).events.at(-1).recovery_permitted !== true)
    throw new Error('Predecessor stopped for investigation or completed its paid work');
  const results = recovered.results;
  const generation = plan.jobs.filter((j) => j.category === 'generation');
  let humans = null;
  if (phase === 'judging') {
    if (!recoveryFrom || generation.some((j) => !results.has(j.id) || results.get(j.id).invalid_response))
      throw new Error('Judging requires complete valid generation');
    humans = loadHumanReferences(plan, results, qualityPath, semanticPath);
    for (const segment of recovered.segments) {
      const previous = path.join(segment.dir, 'human-references.json');
      if (fs.existsSync(previous) && !isDeepStrictEqual(readJson(previous), humans))
        throw new Error('Human references changed during judging recovery');
    }
  }
  if (dispatch === dispatchPilot && !process.env[phase === 'generation' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'])
    throw new Error('Stage API key is absent; no paid admission or reservation');
  // Reuse the shared note check for both units; no bespoke authorization format.
  verifyPaidStudyLaunchContract({
    root,
    designPath: DESIGN_PATH,
    goNotePath,
    goNoteCommit,
    spendCap: design.max_dollars,
  });
  const admission = admitPaidStudyLaunch({
    root,
    designPath: DESIGN_PATH,
    goNotePath,
    goNoteCommit,
    spendCap: design.attempts.hard_ceiling,
    destination: path.resolve(destination),
    studyId: design.id,
    studyStateRoot,
    recoveryFrom: recoveryFrom ? path.resolve(recoveryFrom) : undefined,
    retainedResponseUnits: recoveryFrom ? [...results.keys()] : [],
  });
  const budget = createDurablePaidModelAttemptBudget({ admission, limit: design.attempts.hard_ceiling });
  const stage = phase === 'generation' ? 'GENERATING' : 'AUDITING';
  let status = createLongRunningWorkflowStatus({
    workflowId: design.id,
    phasePlan: ['PREFLIGHT', stage, 'EXTRACTING', 'PACKAGING', 'WORKFLOW_COMPLETE'],
    modelActivity: inactive,
  });
  const statusPath = path.join(admission.destination, 'workflow-status.json');
  let active = null,
    failure = null,
    pause = false;
  const durations = [];
  const update = (activity = inactive) => {
    const events = [...recovered.segments.flatMap((s) => s.events), ...readEvents(admission.ledger_path)];
    const invalid = [...results.values()].filter((r) => r.invalid_response).length;
    status = updateLongRunningWorkflowProgress(status, {
      units: {
        complete: results.size - invalid,
        active: active && !failure ? 1 : 0,
        failed: invalid + (failure && active ? 1 : 0),
        missing: Math.max(0, plan.jobs.length - results.size - (active ? 1 : 0)),
      },
      calls: {
        completed: events.filter((e) => e.type === 'attempt_completed').length,
        failed: events.filter((e) =>
          ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
            e.type,
          ),
        ).length,
        reserved: admission.studyReserved,
        hard_ceiling: design.attempts.hard_ceiling,
      },
      recentUnitDurationsMs: durations.slice(-8),
      modelActivity: activity,
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
      nextAction: next(nextPhase),
    });
    update();
  };
  const requestPause = () => {
    pause = true;
    admission.record({ type: 'pause_requested', job_id: active?.id || null });
  };
  signalTarget.on('SIGINT', requestPause);
  signalTarget.on('SIGTERM', requestPause);
  const heartbeat = setInterval(() => {
    try {
      update(
        active
          ? {
              state: 'unverifiable',
              explanation: 'One HTTP request is pending; provider inference is not independently observable.',
            }
          : inactive,
      );
    } catch {
      pause = true;
    }
  }, 60000);
  heartbeat.unref();
  try {
    writeOnce(path.join(admission.destination, 'plan.json'), plan);
    writeOnce(path.join(admission.destination, 'settings.json'), design);
    if (humans) writeOnce(path.join(admission.destination, 'human-references.json'), humans);
    admission.record({ type: 'stage_started', phase, retained_answers: results.size, seed: plan.seed });
    transition(stage);
    for (const job of plan.jobs.filter((j) =>
      phase === 'generation' ? j.category === 'generation' : j.category !== 'generation',
    )) {
      if (results.has(job.id)) {
        if (job.category === 'generation' && results.get(job.id).invalid_response)
          throw new Error('Invalid frozen generation; no resampling');
        continue;
      }
      if (pause) break;
      active = job;
      const started = Date.now();
      const request = recovered.requests.get(job.id) || buildPilotRequest(design, plan, job, results);
      const cost = checkPilotBudget(design, job, readEvents(admission.study_ledger_path));
      const reservation = budget.reserve({
        unitId: job.id,
        role: job.kind,
        category: job.category,
        max_cost_dollars: cost,
        configured_model: request.body.model,
        configured_provider: request.provider,
      });
      writeOnce(path.join(admission.destination, 'requests', `${reservation.study_reserved}.json`), request);
      budget.markDispatched();
      update({ state: 'unverifiable', explanation: 'One bounded HTTP dispatch is pending.' });
      const raw = await dispatch(request, design.timeout_ms);
      const responsePath = path.join(admission.destination, 'responses', `${reservation.study_reserved}.json`);
      writeOnce(responsePath, { attempt_id: reservation.attemptId, job, request, raw });
      budget.persistResponse(responsePath);
      budget.complete();
      const parsed = parsePilotResponse(design, request, job, raw, pilotPayload(plan, job, results));
      results.set(job.id, parsed);
      admission.record({
        type: parsed.invalid_response ? 'job_invalid' : 'job_complete',
        job_id: job.id,
        reason: parsed.invalid_response || null,
        usage: JSON.parse(raw.body).usage,
      });
      if (job.category === 'generation' && parsed.invalid_response)
        throw new Error('Invalid frozen generation; no resampling');
      durations.push(Date.now() - started);
      active = null;
      update();
    }
    if (pause) {
      admission.record({ type: 'paused', phase });
      status = blockLongRunningWorkflow(status, {
        blockedPhase: stage,
        error: 'Operator pause',
        operation: phase,
        modelActivity: inactive,
        nextAction: next('Resume only missing jobs in a new segment.'),
      });
      update();
      return { status: 'paused_recoverable', results };
    }
    transition('EXTRACTING');
    if (humans)
      writeOnce(path.join(admission.destination, 'report.json'), summarizePilot(design, plan, results, humans));
    else
      writeOnce(path.join(admission.destination, 'human-quality-packet.json'), humanPacket(plan, results, 'quality'));
    transition('PACKAGING');
    const action =
      phase === 'generation'
        ? 'Archive generation, obtain two independent human quality ratings, then release the semantic packet. Judging requires separate launch permission.'
        : 'Review the pilot and verify private archival of all segments and references; no automatic confirmatory launch.';
    writeOnce(path.join(admission.destination, 'archive-inventory.json'), {
      study_id: design.id,
      predecessor: recoveryFrom,
      status: 'private_archive_pending',
      directories: ['requests', 'responses'],
      next_action: action,
    });
    status = completeLongRunningWorkflowPhase(status, {
      phase: 'PACKAGING',
      nextPhase: 'WORKFLOW_COMPLETE',
      handoffExplanation: action,
      nextAction: next(action),
      modelActivity: inactive,
    });
    update();
    return { status: 'handoff_pending', results, destination: admission.destination };
  } catch (error) {
    if (['EIO', 'ENOSPC', 'EMFILE', 'ENFILE', 'EACCES', 'EROFS'].includes(error.code)) error.recoverable = true;
    failure = error;
    budget.fail(error);
    if (error.diagnostic) admission.record({ type: 'transport_failed', job_id: active?.id, ...error.diagnostic });
    status = blockLongRunningWorkflow(status, {
      blockedPhase: status.current_phase,
      error: error.message,
      operation: active?.id || phase,
      modelActivity: inactive,
      nextAction: next('Inspect the saved failure; recover only eligible missing work.'),
    });
    update();
    throw error;
  } finally {
    clearInterval(heartbeat);
    signalTarget.removeListener('SIGINT', requestPause);
    signalTarget.removeListener('SIGTERM', requestPause);
    const events = [...recovered.segments.flatMap((s) => s.events), ...readEvents(admission.ledger_path)];
    const attempts = events.filter(
      (e) => e.type === 'model_attempt_dispatch_reserved' && e.unit_id === active?.id,
    ).length;
    const repeats = failure?.diagnostic
      ? events.filter(
          (e) =>
            e.type === 'transport_failed' &&
            e.name === failure.diagnostic.name &&
            e.cause_code === failure.diagnostic.cause_code &&
            e.stage === failure.diagnostic.stage,
        ).length
      : 0;
    admission.close({
      type: 'run_sealed',
      status: failure
        ? 'technical_failure'
        : pause || phase === 'generation'
          ? 'paused_recoverable'
          : 'local_package_ready',
      recovery_permitted: failure
        ? !!failure.recoverable && attempts < 2 && repeats < 2
        : pause || phase === 'generation',
      reason: failure?.message || (phase === 'generation' ? 'human_reference_handoff' : 'archive_and_review_handoff'),
      complete_jobs: results.size,
      missing_jobs: plan.jobs.length - results.size,
    });
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      prepare: { type: 'boolean' },
      launch: { type: 'boolean' },
      'accept-charges': { type: 'boolean' },
      phase: { type: 'string', default: 'generation' },
      out: { type: 'string' },
      'go-note': { type: 'string' },
      'recovery-from': { type: 'string' },
      'human-packet': { type: 'string' },
      from: { type: 'string' },
      'human-quality': { type: 'string' },
      'human-semantic': { type: 'string' },
    },
  });
  const root = overrides.root || ROOT,
    design = loadPilotDesign(root),
    plan = preparePilot(root, design);
  if ([values.prepare, values.launch, !!values['human-packet']].filter(Boolean).length !== 1 || !values.out)
    throw new Error('Choose --prepare, --human-packet, or --launch and a new --out destination');
  if (values.prepare || values['human-packet']) {
    let packet;
    if (values['human-packet']) {
      const category = values['human-packet'];
      if (!['quality', 'semantic'].includes(category) || !values.from)
        throw new Error('Packet requires quality/semantic and --from');
      const { results } = recoverPilot(design, plan, values.from);
      if (category === 'semantic') validateHumanRatings(plan, results, 'quality', readJson(values['human-quality']));
      packet = { ...humanPacket(plan, results, category), response_schema: SCHEMAS[category] };
    }
    fs.mkdirSync(path.resolve(values.out), { recursive: false });
    if (packet) writeOnce(path.join(values.out, 'packet.json'), packet);
    else {
      writeOnce(path.join(values.out, 'plan.json'), plan);
      writeOnce(path.join(values.out, 'budget.json'), {
        calls: design.attempts,
        max_dollars: design.max_dollars,
        per_generation: reservationCost(design, 'generation'),
        per_judgment: reservationCost(design, 'quality'),
        worst_case: ['generation', 'quality', 'semantic'].reduce(
          (sum, c) =>
            sum + (design.attempts[`${c}_planned`] + design.attempts[`${c}_reserve`]) * reservationCost(design, c),
          0,
        ),
      });
    }
    return { status: 'prepared_zero_calls', destination: path.resolve(values.out) };
  }
  if (!values['accept-charges'] || !values['go-note'])
    throw new Error('Launch requires --accept-charges and the recorded --go-note');
  return executePilot({
    ...overrides,
    root,
    design,
    plan,
    phase: values.phase,
    destination: values.out,
    goNotePath: values['go-note'],
    recoveryFrom: values['recovery-from'],
    qualityPath: values['human-quality'],
    semanticPath: values['human-semantic'],
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((result) => console.log(JSON.stringify({ status: result.status, destination: result.destination })))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
